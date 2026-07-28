// apps/miniapp/src/app.ts

import { Component, createElement, type PropsWithChildren } from "react";
import { AuthProvider } from "./auth/auth.context";
import "./app.scss";
import "@taroify/core/styles/index.css";

class App extends Component<PropsWithChildren> {
  render() {
    return createElement(AuthProvider, null, this.props.children);
  }
}

export default App;
