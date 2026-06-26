import Navbar from "../components/navbar";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative min-h-screen bg-[#F2F2EE] text-[#192837] font-body selection:bg-[#ff7759] selection:text-white">
            <Navbar />
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
