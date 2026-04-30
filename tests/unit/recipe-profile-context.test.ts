import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { RecipeProfileProvider, useRecipeProfile } from "@/components/recipe-profile-context";

function ProfileProbe() {
  const { selectedProfile } = useRecipeProfile();

  return createElement(
    "div",
    null,
    createElement("p", { "data-testid": "selected-profile" }, selectedProfile.name)
  );
}

describe("recipe profile context", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps consumers on the shared household profile", () => {
    render(createElement(RecipeProfileProvider, null, createElement(ProfileProbe)));

    expect(screen.getByTestId("selected-profile")).toHaveTextContent("Household");
  });
});
