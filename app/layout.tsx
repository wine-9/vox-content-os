import "./globals.css";
import { Nav } from "../components/Nav";

export const metadata = {
  title: "VOX Content OS",
  description: "VOX 音乐教室内容生产系统"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="shell">
          <Nav />
          {children}
        </main>
      </body>
    </html>
  );
}
