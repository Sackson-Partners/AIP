export default function InvestorsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
