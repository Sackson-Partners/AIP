'use client';

import { useEffect, useState } from 'react';
import { projectsApi, investorsApi, verificationsApi, eventsApi, Project, Investor, Event } from '../../lib/api';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({
    projects: 0,
    investors: 0,
    verifications: 0,
    events: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentInvestors, setRecentInvestors] = useState<Investor[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projects, investors, verifications, events] = await Promise.all([
          projectsApi.list(),
          investorsApi.list(),
          verificationsApi.list(),
          eventsApi.list(),
        ]);

        setStats({
          projects:      projects.length,
          investors:     investors.length,
          verifications: verifications.length,
          events:        events.length,
        });

        setRecentProjects(projects.slice(0, 5));
        setRecentInvestors(investors.slice(0, 5));
        setUpcomingEvents(events.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Projects"
          value={stats.projects}
          icon={<FolderIcon />}
          color="bg-blue-500"
          href="/dashboard/projects"
        />
        <StatCard
          title="Investors"
          value={stats.investors}
          icon={<UsersIcon />}
          color="bg-green-500"
          href="/dashboard/investors"
        />
        <StatCard
          title="Verifications"
          value={stats.verifications}
          icon={<ShieldIcon />}
          color="bg-purple-500"
          href="/dashboard/verifications"
        />
        <StatCard
          title="Events"
          value={stats.events}
          icon={<CalendarIcon />}
          color="bg-orange-500"
          href="/dashboard/events"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Projects</h2>
            <Link href="/dashboard/projects" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          {recentProjects.length > 0 ? (
            <div className="space-y-4">
              {recentProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{project.name}</p>
                    <p className="text-sm text-gray-500">{project.sector} - {project.country}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getStageColor(project.stage)}`}>
                    {project.stage}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No projects yet</p>
          )}
        </div>

        {/* Recent Investors */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Investors</h2>
            <Link href="/dashboard/investors" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          {recentInvestors.length > 0 ? (
            <div className="space-y-4">
              {recentInvestors.map((investor) => (
                <div key={investor.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{investor.fund_name}</p>
                    <p className="text-sm text-gray-500">
                      ${formatNumber(investor.ticket_size_min)} - ${formatNumber(investor.ticket_size_max)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {investor.instruments.slice(0, 2).map((inst) => (
                      <span key={inst} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No investors yet</p>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Events</h2>
            <Link href="/dashboard/events" className="text-sm text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="p-4 border border-gray-200 rounded-lg">
                  <p className="font-medium text-gray-900">{event.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{event.description}</p>
                  <div className="flex items-center mt-2 text-sm text-gray-600">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {event.event_date}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No upcoming events</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
  href,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <div className="w-6 h-6 text-white">{icon}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function getStageColor(stage: string) {
  const colors: Record<string, string> = {
    Concept: 'bg-gray-100 text-gray-800',
    Feasibility: 'bg-blue-100 text-blue-800',
    Procurement: 'bg-yellow-100 text-yellow-800',
    Construction: 'bg-orange-100 text-orange-800',
    Operation: 'bg-green-100 text-green-800',
  };
  return colors[stage] || 'bg-gray-100 text-gray-800';
}

function formatNumber(num: number) {
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function FolderIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}
