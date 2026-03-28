export default function ProjectsLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-800 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
