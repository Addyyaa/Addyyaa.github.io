import React, { useEffect } from "react";

export default function V2rayOutboundsGenerator(): JSX.Element {
  useEffect(() => {
    window.location.replace("/v2ray-outbounds-generator.html");
  }, []);

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <p>正在跳转到配置生成工具...</p>
      <p>
        如果没有自动跳转，请点击
        <a href="/v2ray-outbounds-generator.html">这里</a>。
      </p>
    </main>
  );
}
