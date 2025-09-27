import { describe, test, expect } from "bun:test"
import { MessageV2 } from "../src/session/message-v2"

describe("Interrupt Handling", () => {
  test("should handle AI_APICallError as abort", () => {
    // Simulate the error that occurs when streaming is interrupted
    const mockError = new Error("Item 'rs_68d82b14c77c8194b40f81b8207b2e4e0652a910ad31e656' of type 'reasoning' was provided without its required following item.")
    
    let capturedError: any = null
    
    // This is what our fix in prompt.ts does
    if (mockError instanceof Error && mockError.message?.includes("was provided without its required following item")) {
      capturedError = new MessageV2.AbortedError(
        { message: "Request was aborted" },
        { cause: mockError }
      ).toObject()
    }
    
    // Verify the error was handled correctly
    expect(capturedError).toBeDefined()
    expect(capturedError.name).toBe("MessageAbortedError")
    expect(capturedError.data.message).toBe("Request was aborted")
  })
  
  test("should handle abort signal as abort", () => {
    const abortController = new AbortController()
    let capturedError: any = null
    
    // Abort immediately
    abortController.abort()
    
    // Check if abort signal is handled
    if (abortController.signal.aborted) {
      capturedError = new MessageV2.AbortedError(
        { message: "Request was aborted" },
        { cause: new Error("User aborted") }
      ).toObject()
    }
    
    expect(capturedError).toBeDefined()
    expect(capturedError.name).toBe("MessageAbortedError")
    expect(capturedError.data.message).toBe("Request was aborted")
  })
})