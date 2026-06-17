import { createContext, useContext } from "react";

// Cho phép mọi view điều hướng sang view khác (kèm payload, vd mở 1 task cụ thể).
export const NavContext = createContext(() => {});

export function useNav() {
  return useContext(NavContext);
}
