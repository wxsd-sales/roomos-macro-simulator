import { products } from "../../modules/productHelper.ts";
import { simulatorDevice } from "../app/simulatorDevice.ts";

function getProductOptions(): string[] {
  return [...new Set(Object.values(products))].sort((a, b) => a.localeCompare(b));
}

export function ProductSelect() {
  const options = getProductOptions();
  const defaultProductName = simulatorDevice.profile.productName;

  return (
    <label className="topbar-select-shell" htmlFor="product-select">
      <span className="sr-only">Select product</span>
      <select
        id="product-select"
        className="topbar-select"
        aria-label="Select product"
        defaultValue={defaultProductName}
      >
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
