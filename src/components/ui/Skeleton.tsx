function cx(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cx('animate-pulse rounded-md bg-gray-200', className)} />
  );
}

/** 4-card stat row skeleton (dashboard home) */
export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Table rows skeleton (projects page) */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton
                key={j}
                className={cx(
                  'h-4',
                  j === 0 ? 'w-48' : 'w-24',
                  j === cols - 1 ? 'ml-auto w-16' : '',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kanban column skeleton (pipeline page) */
export function KanbanSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-64 bg-gray-50 rounded-xl p-4 space-y-3">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="bg-white rounded-lg p-3 space-y-2 border border-gray-100">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Card list skeleton (IC sessions) */
export function CardListSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
