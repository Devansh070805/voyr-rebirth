"use client";

/**
 * useBooking — Booking state machine management.
 *
 * Manages the booking flow state: package_created → quote_generated → checkout_ready.
 * Exposes handlers for tool_result events and a startBooking shortcut.
 */

import { useState, useCallback } from "react";
import type { ToolCallData, ToolResultData, BookingState } from "@/types/chat";

export interface UseBookingReturn {
  bookingState: BookingState;
  handleToolResult: (result: ToolResultData, toolCalls: ToolCallData[], assistantId: string, onUpdateToolCalls: (tc: ToolCallData[]) => void) => void;
  startBooking: (sendMessage: (msg: string) => void) => void;
  resetBooking: () => void;
}

const INITIAL_BOOKING_STATE: BookingState = {
  packageId: null,
  quoteId: null,
  finalAmount: null,
  validUntil: null,
  checkoutUrl: null,
  paymentId: null,
  status: "idle",
  error: null,
};

export function useBooking(): UseBookingReturn {
  const [bookingState, setBookingState] = useState<BookingState>(INITIAL_BOOKING_STATE);

  const handleToolResult = useCallback(
    (result: ToolResultData, toolCalls: ToolCallData[], _assistantId: string, onUpdateToolCalls: (tc: ToolCallData[]) => void) => {
      if (!result.success) {
        setBookingState((prev) => ({
          ...prev,
          status: "error",
          error: result.data.error as string,
        }));
        return;
      }

      switch (result.tool_name) {
        case "create_package":
          setBookingState((prev) => ({
            ...prev,
            packageId: result.data.package_id as string,
            status: "package_created",
            error: null,
          }));
          // Update the tool call with the real package_id
          const pkgIdx = toolCalls.findIndex((tc) => tc.name === "create_package");
          if (pkgIdx >= 0) {
            toolCalls[pkgIdx] = {
              ...toolCalls[pkgIdx],
              arguments: {
                ...toolCalls[pkgIdx].arguments,
                package_id: result.data.package_id as string,
              },
            };
            onUpdateToolCalls([...toolCalls]);
          }
          break;
        case "generate_quote":
          setBookingState((prev) => ({
            ...prev,
            quoteId: result.data.quote_id as string,
            finalAmount: result.data.final_amount as number,
            validUntil: result.data.valid_until as string,
            status: "quote_generated",
            error: null,
          }));
          break;
        case "start_checkout":
          setBookingState((prev) => ({
            ...prev,
            checkoutUrl: result.data.checkout_url as string,
            paymentId: result.data.payment_id as string,
            status: "checkout_ready",
            error: null,
          }));
          break;
      }
    },
    [],
  );

  const startBooking = useCallback((sendMessage: (msg: string) => void) => {
    sendMessage("I'm ready to book this trip. Please create a package for me.");
  }, []);

  const resetBooking = useCallback(() => {
    setBookingState(INITIAL_BOOKING_STATE);
  }, []);

  return {
    bookingState,
    handleToolResult,
    startBooking,
    resetBooking,
  };
}
