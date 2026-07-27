// apps/miniapp/src/app.ts

import { Component, type PropsWithChildren } from "react";
import "./app.css";
import "@taroify/core/styles/index.css";

class App extends Component<PropsWithChildren> {
  render() {
    return this.props.children;
  }
}

export default App;
