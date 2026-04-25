// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BaseCanvas } from "../BaseCanvas";

function mockCanvasContext() {
  const context = {
    fillRect: vi.fn(),
    scale: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    set fillStyle(_value: string) {},
    set lineCap(_value: string) {},
    set lineJoin(_value: string) {},
    set lineWidth(_value: number) {},
    set strokeStyle(_value: string) {},
  };

  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
}

function mockCanvasElement(canvas: HTMLCanvasElement) {
  vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,test");
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 500,
    right: 800,
    width: 800,
    height: 500,
    toJSON: () => ({}),
  });
}

describe("BaseCanvas", () => {
  it("passes current strokes to onSave when a stroke completes", () => {
    const onSave = vi.fn();
    const onDrawChange = vi.fn();
    mockCanvasContext();
    render(<BaseCanvas onDrawChange={onDrawChange} onSave={onSave} />);

    const canvas = screen.getByRole("img", { name: "אזור לציור" }) as HTMLCanvasElement;
    mockCanvasElement(canvas);

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", clientX: 10, clientY: 20, pressure: 0.5 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "mouse", clientX: 30, clientY: 40, pressure: 0.5 });

    expect(onDrawChange).toHaveBeenCalledWith([[expect.objectContaining({ x: 10, y: 20 })]]);
    expect(onSave).toHaveBeenCalledWith("data:image/png;base64,test", [
      [expect.objectContaining({ x: 10, y: 20 })],
    ]);
  });
});
