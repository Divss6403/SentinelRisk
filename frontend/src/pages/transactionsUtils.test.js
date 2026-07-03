import { filterTransactions, getVisibleTransactions } from "./Transactions";

describe("getVisibleTransactions", () => {
  it("returns only rows matching uploaded order ids when provided", () => {
    const rows = [{ order_id: "A" }, { order_id: "B" }, { order_id: "C" }];

    expect(getVisibleTransactions(rows, ["B", "C"]) ).toEqual([{ order_id: "B" }, { order_id: "C" }]);
  });

  it("returns all rows when no uploaded order ids are provided", () => {
    const rows = [{ order_id: "A" }, { order_id: "B" }];

    expect(getVisibleTransactions(rows, [])).toEqual(rows);
  });
});

describe("filterTransactions", () => {
  const rows = [
    { order_id: "ORD-001", customer_id: "CUS-42", amount: 1500, country: "India", device: "android", action: "BLOCK" },
    { order_id: "ORD-002", customer_id: "CUS-43", amount: 2500, country: "USA", device: "ios", action: "APPROVE" },
    { order_id: "ORD-003", customer_id: "CUS-44", amount: 2500, country: "India", device: "windows", action: "REVIEW" },
  ];

  it("searches order, customer, amount, country, device, and action fields", () => {
    expect(filterTransactions(rows, [], "", "ORD-001")).toEqual([rows[0]]);
    expect(filterTransactions(rows, [], "", "cus-43")).toEqual([rows[1]]);
    expect(filterTransactions(rows, [], "", "2500")).toEqual([rows[1], rows[2]]);
    expect(filterTransactions(rows, [], "", "india")).toEqual([rows[0], rows[2]]);
    expect(filterTransactions(rows, [], "", "windows")).toEqual([rows[2]]);
    expect(filterTransactions(rows, [], "", "approve")).toEqual([rows[1]]);
  });
});
