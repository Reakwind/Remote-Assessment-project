// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
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

function mockCanvasElement(
  canvas: HTMLCanvasElement,
  rect: Partial<DOMRect> = {},
) {
  vi.spyOn(canvas, "toDataURL").mockReturnValue("data:image/png;base64,test");
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  const width = rect.width ?? 800;
  const height = rect.height ?? 500;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: rect.top ?? 0,
    left: rect.left ?? 0,
    bottom: rect.bottom ?? height,
    right: rect.right ?? width,
    width,
    height,
    toJSON: () => ({}),
  });
}

describe("BaseCanvas", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

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

  it("keeps touch scrolling disabled on the drawing surface", () => {
    mockCanvasContext();
    render(<BaseCanvas />);

    const canvas = screen.getByRole("img", { name: "אזור לציור" }) as HTMLCanvasElement;

    expect(canvas).toHaveClass("touch-none");
    expect(canvas).toHaveStyle({ touchAction: "none" });
  });

  it("keeps undo and clear controls available with stable labels after drawing", async () => {
    const onSave = vi.fn();
    mockCanvasContext();
    render(<BaseCanvas onSave={onSave} />);
    const canvas = screen.getByTestId("drawing-canvas") as HTMLCanvasElement;
    mockCanvasElement(canvas);

    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20, pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20, pointerId: 1, pointerType: "touch" });

    expect(screen.getByRole("button", { name: /בטל פעולה/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /מחיקת ציור/ })).toBeEnabled();
  });

  it("saves the partial stroke when the pointer is cancelled", () => {
    const onSave = vi.fn();
    const onDrawChange = vi.fn();
    mockCanvasContext();
    render(<BaseCanvas onDrawChange={onDrawChange} onSave={onSave} />);

    const canvas = screen.getByRole("img", { name: "אזור לציור" }) as HTMLCanvasElement;
    mockCanvasElement(canvas);

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "touch", clientX: 10, clientY: 20, pressure: 0.5 });
    fireEvent.pointerCancel(canvas, { pointerId: 1, pointerType: "touch", clientX: 20, clientY: 30, pressure: 0.5 });

    expect(onDrawChange).toHaveBeenCalledWith([[expect.objectContaining({ pointerType: "touch" })]]);
    expect(onSave).toHaveBeenCalledWith("data:image/png;base64,test", [
      [expect.objectContaining({ pointerType: "touch" })],
    ]);
  });

  it("scales pointer coordinates from displayed canvas size to logical drawing size", () => {
    const onDrawChange = vi.fn();
    mockCanvasContext();
    render(<BaseCanvas width={800} height={400} onDrawChange={onDrawChange} />);

    const canvas = screen.getByRole("img", { name: "אזור לציור" }) as HTMLCanvasElement;
    mockCanvasElement(canvas, { width: 400, height: 200, right: 400, bottom: 200 });

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", clientX: 200, clientY: 100, pressure: 0.5 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "mouse", clientX: 200, clientY: 100, pressure: 0.5 });

    expect(onDrawChange).toHaveBeenCalledWith([[expect.objectContaining({ x: 400, y: 200 })]]);
  });

  it("requires confirmation before clearing all strokes", () => {
    const onSave = vi.fn();
    const onDrawChange = vi.fn();
    mockCanvasContext();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<BaseCanvas onDrawChange={onDrawChange} onSave={onSave} />);

    const canvas = screen.getByRole("img", { name: "אזור לציור" }) as HTMLCanvasElement;
    mockCanvasElement(canvas);

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", clientX: 10, clientY: 20, pressure: 0.5 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "mouse", clientX: 30, clientY: 40, pressure: 0.5 });
    fireEvent.click(screen.getByRole("button", { name: /מחיקת ציור/ }));

    expect(window.confirm).toHaveBeenCalledWith("האם למחוק את כל הציור?");
    expect(onDrawChange).not.toHaveBeenCalledWith([]);
    expect(onSave).not.toHaveBeenCalledWith("", []);
  });

  it("clears all strokes after confirmation", () => {
    const onSave = vi.fn();
    const onDrawChange = vi.fn();
    mockCanvasContext();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<BaseCanvas onDrawChange={onDrawChange} onSave={onSave} />);

    const canvas = screen.getByRole("img", { name: "אזור לציור" }) as HTMLCanvasElement;
    mockCanvasElement(canvas);

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", clientX: 10, clientY: 20, pressure: 0.5 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "mouse", clientX: 30, clientY: 40, pressure: 0.5 });
    fireEvent.click(screen.getByRole("button", { name: /מחיקת ציור/ }));

    expect(onDrawChange).toHaveBeenCalledWith([]);
    expect(onSave).toHaveBeenCalledWith("", []);
  });
});
