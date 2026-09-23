// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LlmSettingsPanel } from "./LlmSettingsPanel";

const getDirectorModel = vi.fn();
const setDirectorModel = vi.fn();

vi.mock("../director/api", () => ({
  getDirectorModel: (...args: unknown[]) => getDirectorModel(...args),
  setDirectorModel: (...args: unknown[]) => setDirectorModel(...args),
}));

describe("LlmSettingsPanel", () => {
  beforeEach(() => {
    getDirectorModel.mockResolvedValue({
      model: "qwen-a",
      provider: "llama-swap",
      reachable: true,
      available: ["qwen-a", "qwen-b"],
      agent_runtime: "harness",
      endpoint_url: "http://127.0.0.1:8080/v1",
      uses_local_gpu: true,
      persisted_to: "data/director_model.json",
      source: "persisted",
    });
    setDirectorModel.mockResolvedValue({
      model: "qwen-b",
      provider: "llama-swap",
      available: ["qwen-a", "qwen-b"],
      source: "persisted",
      agent_runtime: "harness",
      endpoint_url: "http://127.0.0.1:8080/v1",
      uses_local_gpu: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists llama-swap models and persists the selection", async () => {
    render(<LlmSettingsPanel active />);

    expect(await screen.findByText(/Harness \(Node sidecar loop\)/)).toBeTruthy();
    expect(screen.getByText("http://127.0.0.1:8080/v1")).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "qwen-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Save model" }));

    await waitFor(() => {
      expect(setDirectorModel).toHaveBeenCalledWith("qwen-b", true);
    });
    expect(await screen.findByText(/Saved for chat/)).toBeTruthy();
  });
});
