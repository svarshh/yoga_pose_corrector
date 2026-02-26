
import { createBrowserRouter } from "react-router";
import AppLayout from "./components/AppLayout";
import Home from "./pages/Home";
import Battle from "./pages/Battle";
import Analysis from "./pages/Analysis";
import Result from "./pages/Result";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AppLayout,
    children: [
      { index: true, Component: Home },
      { path: "battle/:poseId", Component: Battle },
      { path: "analysis/:poseId", Component: Analysis },
      { path: "result/:poseId", Component: Result },
    ],
  },
]);
