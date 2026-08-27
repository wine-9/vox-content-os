import "./globals.css";
import { Nav, SideNav } from "../components/Nav";

export const metadata = {
  title: "VOX Content OS",
  description: "VOX 音乐教室内容生产系统"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <Nav />
          <div className="app-layout">
            <SideNav />
            <main className="main-content">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
