"use client";

import ProtectedRoute from "../auth/ProtectedRoute";
import { BookingsContent } from "./BookingsContent";

export default function BookingsPage() {
  return (
    <ProtectedRoute>
      <BookingsContent />
    </ProtectedRoute>
  );
}
