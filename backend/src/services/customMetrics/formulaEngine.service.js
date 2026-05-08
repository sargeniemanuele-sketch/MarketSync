const OP_INFO = Object.freeze({
  '+': { precedence: 1, associativity: 'left', arity: 2 },
  '-': { precedence: 1, associativity: 'left', arity: 2 },
  '*': { precedence: 2, associativity: 'left', arity: 2 },
  '/': { precedence: 2, associativity: 'left', arity: 2 },
  'u-': { precedence: 3, associativity: 'right', arity: 1 },
});

export class FormulaEvaluationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FormulaEvaluationError';
    this.code = code;
  }
}

function toNumericOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function tokenizeFormula(formula) {
  const source = String(formula ?? '');
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const start = i;
      let dotCount = 0;

      while (i < source.length && /[0-9.]/.test(source[i])) {
        if (source[i] === '.') dotCount += 1;
        i += 1;
      }

      const raw = source.slice(start, i);
      if (dotCount > 1 || raw === '.') {
        throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula contains an invalid number token');
      }

      const num = Number(raw);
      if (!Number.isFinite(num)) {
        throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula contains a non-finite number');
      }

      tokens.push({ type: 'number', value: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = i;
      i += 1;
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) {
        i += 1;
      }
      tokens.push({ type: 'identifier', value: source.slice(start, i) });
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch });
      i += 1;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch });
      i += 1;
      continue;
    }

    if (['+', '-', '*', '/'].includes(ch)) {
      tokens.push({ type: 'operator', value: ch });
      i += 1;
      continue;
    }

    throw new FormulaEvaluationError('FORMULA_INVALID', `Formula contains an invalid character '${ch}'`);
  }

  if (tokens.length === 0) {
    throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula must not be empty');
  }

  return tokens;
}

function toRpn(tokens) {
  const output = [];
  const operators = [];
  let prevType = 'start';

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'identifier') {
      output.push(token);
      prevType = 'operand';
      continue;
    }

    if (token.type === 'operator') {
      let op = token.value;

      if (op === '-' && (prevType === 'start' || prevType === 'operator' || prevType === 'lparen')) {
        op = 'u-';
      }

      const opInfo = OP_INFO[op];
      if (!opInfo) {
        throw new FormulaEvaluationError('FORMULA_INVALID', `Unsupported operator '${op}'`);
      }

      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.type !== 'operator') break;

        const topInfo = OP_INFO[top.value];
        const shouldPop =
          (opInfo.associativity === 'left' && opInfo.precedence <= topInfo.precedence) ||
          (opInfo.associativity === 'right' && opInfo.precedence < topInfo.precedence);

        if (!shouldPop) break;
        output.push(operators.pop());
      }

      operators.push({ type: 'operator', value: op });
      prevType = 'operator';
      continue;
    }

    if (token.type === 'lparen') {
      operators.push(token);
      prevType = 'lparen';
      continue;
    }

    if (token.type === 'rparen') {
      let foundLeftParen = false;

      while (operators.length > 0) {
        const top = operators.pop();
        if (top.type === 'lparen') {
          foundLeftParen = true;
          break;
        }
        output.push(top);
      }

      if (!foundLeftParen) {
        throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula has mismatched parentheses');
      }

      prevType = 'operand';
    }
  }

  while (operators.length > 0) {
    const top = operators.pop();
    if (top.type === 'lparen' || top.type === 'rparen') {
      throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula has mismatched parentheses');
    }
    output.push(top);
  }

  return output;
}

function evaluateRpn(rpnTokens, variableValues) {
  const stack = [];

  for (const token of rpnTokens) {
    if (token.type === 'number') {
      stack.push(token.value);
      continue;
    }

    if (token.type === 'identifier') {
      if (!(token.value in variableValues)) {
        throw new FormulaEvaluationError(
          'VARIABLE_NOT_DECLARED',
          `Variable '${token.value}' is not declared for this custom metric`
        );
      }

      const value = toNumericOrNull(variableValues[token.value]);
      if (value == null) {
        throw new FormulaEvaluationError(
          'VARIABLE_NOT_RESOLVED',
          `Variable '${token.value}' is missing or not numeric`
        );
      }

      stack.push(value);
      continue;
    }

    if (token.type === 'operator') {
      const op = token.value;
      const opInfo = OP_INFO[op];

      if (opInfo.arity === 1) {
        if (stack.length < 1) {
          throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula cannot be evaluated');
        }

        stack.push(-stack.pop());
        continue;
      }

      if (stack.length < 2) {
        throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula cannot be evaluated');
      }

      const b = stack.pop();
      const a = stack.pop();

      if (op === '+') stack.push(a + b);
      else if (op === '-') stack.push(a - b);
      else if (op === '*') stack.push(a * b);
      else if (op === '/') {
        if (b === 0) {
          throw new FormulaEvaluationError('DIVISION_BY_ZERO', 'Division by zero in custom metric formula');
        }
        stack.push(a / b);
      }
    }
  }

  if (stack.length !== 1 || !Number.isFinite(stack[0])) {
    throw new FormulaEvaluationError('FORMULA_INVALID', 'Formula did not resolve to a valid number');
  }

  return stack[0];
}

export function getFormulaIdentifiers(formula) {
  return tokenizeFormula(formula)
    .filter((token) => token.type === 'identifier')
    .map((token) => token.value);
}

export function validateFormulaIdentifiers(formula, allowedVariableKeys) {
  const allowed = new Set(allowedVariableKeys);
  const identifiers = getFormulaIdentifiers(formula);
  const undeclared = [...new Set(identifiers.filter((identifier) => !allowed.has(identifier)))];

  if (undeclared.length > 0) {
    throw new FormulaEvaluationError(
      'VARIABLE_NOT_DECLARED',
      `Formula uses undeclared variable(s): ${undeclared.join(', ')}`
    );
  }

  return identifiers;
}

export function evaluateFormula(formula, variableValues, allowedVariableKeys = Object.keys(variableValues ?? {})) {
  validateFormulaIdentifiers(formula, allowedVariableKeys);
  const tokens = tokenizeFormula(formula);
  return evaluateRpn(toRpn(tokens), variableValues);
}
