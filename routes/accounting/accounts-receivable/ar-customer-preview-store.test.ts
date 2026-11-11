import { beforeEach, expect, it } from "vitest";
import {
  readPreviewCustomers,
  removePreviewCustomer,
  writePreviewCustomers,
} from "./ar-customer-preview-store";

beforeEach(() => sessionStorage.clear());

it("keeps profile edits across reads and prevents orphaning a contract", () => {
  const initial = readPreviewCustomers();
  const [profile] = initial.profiles;
  const [contract] = initial.contracts;
  writePreviewCustomers({ ...initial, profiles: [{ ...profile, name: "Updated customer" }] });
  const saved = readPreviewCustomers();
  expect(saved.profiles[0].name).toBe("Updated customer");
  expect(saved.contracts[0].profileId).toBe(profile.id);
  expect(removePreviewCustomer(saved, "profiles", profile.id)).toBeNull();

  const withoutContract = removePreviewCustomer(saved, "contracts", contract.id)!;
  const empty = removePreviewCustomer(withoutContract, "profiles", profile.id)!;
  writePreviewCustomers(empty);
  expect(readPreviewCustomers()).toEqual({ profiles: [], contracts: [] });
});
