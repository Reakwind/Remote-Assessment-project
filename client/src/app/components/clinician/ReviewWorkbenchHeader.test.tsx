// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReviewWorkbenchHeader } from "./ReviewWorkbenchHeader";

describe("ReviewWorkbenchHeader", () => {
  it("shows provisional state and pending review count", () => {
    render(
      <ReviewWorkbenchHeader
        caseLabel="CASE-1"
        status="awaiting_review"
        pendingReviewCount={3}
        totalScore={24}
        totalProvisional={true}
        canExportPdf={false}
      />,
    );

    expect(screen.getByText("תיק CASE-1")).toBeInTheDocument();
    expect(screen.getByText("3 פריטים ממתינים לסקירה")).toBeInTheDocument();
    expect(screen.getByText("ציון זמני 24/30")).toBeInTheDocument();
    expect(screen.getByText("PDF זמין לאחר סיום סקירה")).toBeInTheDocument();
  });
});
