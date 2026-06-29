import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:8001";
export const API = `${BACKEND_URL}/api`;

export const http = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

export const api = {
  // rules
  listRules: () => http.get("/rules").then(r => r.data),
  createRule: (data) => http.post("/rules", data).then(r => r.data),
  updateRule: (id, data) => http.put(`/rules/${id}`, data).then(r => r.data),
  deleteRule: (id) => http.delete(`/rules/${id}`).then(r => r.data),
  validateRule: (condition) => http.post("/rules/validate", { condition }).then(r => r.data),
  // check
  checkFraud: (order) => http.post("/check_fraud", order).then(r => r.data),
  checkFraudUpload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return axios.post(`${API}/check_fraud/upload`, fd).then(r => r.data);
  },
  // transactions
  listTransactions: (params) => http.get("/transactions", { params }).then(r => r.data),
  getTransaction: (id) => http.get(`/transactions/${id}`).then(r => r.data),
  // dashboard
  stats: () => http.get("/dashboard/stats").then(r => r.data),
  timeseries: (days = 14) => http.get("/dashboard/timeseries", { params: { days } }).then(r => r.data),
  actionDistribution: () => http.get("/dashboard/action-distribution").then(r => r.data),
  topRules: () => http.get("/dashboard/top-rules").then(r => r.data),
  countryStats: () => http.get("/dashboard/country-stats").then(r => r.data),
  reseed: (force = false) => http.post(`/admin/seed?force=${force}`).then(r => r.data),
};
