import { unwrapApiData } from "./authApi.js";
import axiosClient from "./axiosClient.js";

function unwrapProfile(response) {
  const payload = unwrapApiData(response);
  return payload?.profile ?? payload ?? null;
}

function stripUndefined(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

export async function getProfile() {
  const response = await axiosClient.get("/profile");
  return unwrapProfile(response);
}

export async function updateProfile(payload) {
  const response = await axiosClient.patch("/profile", stripUndefined(payload));
  return unwrapProfile(response);
}

export async function deleteProfile() {
  const response = await axiosClient.delete("/profile");
  return unwrapApiData(response);
}

export async function uploadProfileAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await axiosClient.patch("/profile/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return unwrapProfile(response);
}

export async function deleteProfileAvatar() {
  const response = await axiosClient.delete("/profile/avatar");
  return unwrapProfile(response);
}
