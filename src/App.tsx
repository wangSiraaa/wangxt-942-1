import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Layout from "@/components/layout/Layout";
import ToastContainer from "@/components/common/Toast";
import HostHome from "@/pages/host/HostHome";
import HostRooms from "@/pages/host/HostRooms";
import HostPricing from "@/pages/host/HostPricing";
import HostCalendar from "@/pages/host/HostCalendar";
import HostOrders from "@/pages/host/HostOrders";
import OpsHome from "@/pages/ops/OpsHome";
import OpsMaintenance from "@/pages/ops/OpsMaintenance";
import OpsOrders from "@/pages/ops/OpsOrders";
import GuestHome from "@/pages/guest/GuestHome";
import GuestBooking from "@/pages/guest/GuestBooking";
import GuestOrders from "@/pages/guest/GuestOrders";

export default function App() {
  return (
    <Router>
      <ToastContainer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Layout role="host"><HostHome /></Layout>} />
        <Route path="/host/rooms" element={<Layout role="host"><HostRooms /></Layout>} />
        <Route path="/host/pricing" element={<Layout role="host"><HostPricing /></Layout>} />
        <Route path="/host/calendar" element={<Layout role="host"><HostCalendar /></Layout>} />
        <Route path="/host/orders" element={<Layout role="host"><HostOrders /></Layout>} />
        <Route path="/ops" element={<Layout role="ops"><OpsHome /></Layout>} />
        <Route path="/ops/maintenance" element={<Layout role="ops"><OpsMaintenance /></Layout>} />
        <Route path="/ops/orders" element={<Layout role="ops"><OpsOrders /></Layout>} />
        <Route path="/guest" element={<Layout role="guest"><GuestHome /></Layout>} />
        <Route path="/guest/booking" element={<Layout role="guest"><GuestBooking /></Layout>} />
        <Route path="/guest/orders" element={<Layout role="guest"><GuestOrders /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
