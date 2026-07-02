import type { Metadata } from "next";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "管理模式 | 狼狼按鈕",
};

export default function AdminPage() {
  return <AdminClient />;
}
