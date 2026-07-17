export const metadata = {
  title: 'Québec Logistics Tycoon',
  description: 'Gère tes entrepôts, livre les magasins du Québec, deviens le roi de la logistique !',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}