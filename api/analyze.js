import { handleVercel } from "../vercel-api.mjs";
export default {
  fetch(request) {
    return handleVercel(request, "/api/analyze");
  },
};
