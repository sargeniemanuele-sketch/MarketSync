import axiosClient from "./axiosClient.js";

function unwrapBootstrapResponse(response) {
  const body = response?.data ?? {};

  if (Object.prototype.hasOwnProperty.call(body, "success")) {
    return {
      data: body.data ?? null,
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      meta: body.meta ?? {},
    };
  }

  return {
    data: body ?? null,
    warnings: [],
    meta: {},
  };
}

export async function getBootstrap() {
  const response = await axiosClient.get("/app/bootstrap");
  return unwrapBootstrapResponse(response);
}
