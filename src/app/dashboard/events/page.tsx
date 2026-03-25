'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { eventsApi, projectsApi, Event, EventCreate, Project } from '../../../lib/api';

const EVENT_TYPES = ['Conference', 'Webinar', 'Workshop', 'Networking', 'Investment Forum', 'Site Visit', 'Other'];

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventCreate>();

  const fetchData = async () => {
    try {
      const [eventsData, projectsData] = await Promise.all([
        eventsApi.list(),
        projectsApi.list(),
      ]);
      setEvents(eventsData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSubmit = async (data: EventCreate) => {
    try {
      const formattedData = {
        ...data,
        projects_involved: data.projects_involved
          ? (Array.isArray(data.projects_involved)
              ? data.projects_involved.map(Number)
              : [Number(data.projects_involved)])
          : [],
      };
      await eventsApi.create(formattedData);
      setShowModal(false);
      reset();
      fetchData();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  };

  const getProjectName = (projectId: number) => {
    const project = projects.find(p => String(p.id) === String(projectId));
    return project?.project_name || `Project #${projectId}`;
  };

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.event_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filter === 'upcoming') return eventDate >= today;
    if (filter === 'past') return eventDate < today;
    return true;
  });

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      Conference: 'bg-blue-100 text-blue-800',
      Webinar: 'bg-green-100 text-green-800',
      Workshop: 'bg-purple-100 text-purple-800',
      Networking: 'bg-orange-100 text-orange-800',
      'Investment Forum': 'bg-yellow-100 text-yellow-800',
      'Site Visit': 'bg-teal-100 text-teal-800',
      Other: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const isUpcoming = (date: string) => {
    return new Date(date) >= new Date();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Events</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          New Event
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-2 mb-6 inline-flex">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All Events
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'upcoming' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'past' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Past
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="flex items-start gap-6">
                  {/* Date Badge */}
                  <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center ${
                    isUpcoming(event.event_date) ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <span className={`text-2xl font-bold ${
                      isUpcoming(event.event_date) ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {new Date(event.event_date).getDate()}
                    </span>
                    <span className={`text-xs uppercase ${
                      isUpcoming(event.event_date) ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {new Date(event.event_date).toLocaleString('default', { month: 'short' })}
                    </span>
                  </div>

                  {/* Event Details */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{event.name}</h3>
                        <p className="text-gray-600 mt-1">{event.description}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs rounded-full ${getEventTypeColor(event.type)}`}>
                        {event.type}
                      </span>
                    </div>

                    {event.projects_involved && event.projects_involved.length > 0 && (
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-sm text-gray-500">Related projects:</span>
                        <div className="flex flex-wrap gap-2">
                          {event.projects_involved.slice(0, 3).map((projectId) => (
                            <span
                              key={projectId}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {getProjectName(projectId)}
                            </span>
                          ))}
                          {event.projects_involved.length > 3 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                              +{event.projects_involved.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <CalendarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {filter === 'upcoming'
                  ? 'No upcoming events scheduled.'
                  : filter === 'past'
                  ? 'No past events found.'
                  : 'No events found. Create your first event.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Event Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Create Event</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Africa Investment Forum 2024"
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  {...register('description', { required: 'Description is required' })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the event..."
                />
                {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Date *</label>
                  <input
                    {...register('event_date', { required: 'Date is required' })}
                    type="date"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.event_date && <p className="text-red-500 text-sm mt-1">{errors.event_date.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                  <select
                    {...register('type', { required: 'Type is required' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type</option>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type.message}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related Projects</label>
                <select
                  {...register('projects_involved')}
                  multiple
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                >
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selectedEvent.name}</h2>
                <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center ${
                  isUpcoming(selectedEvent.event_date) ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  <span className={`text-2xl font-bold ${
                    isUpcoming(selectedEvent.event_date) ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {new Date(selectedEvent.event_date).getDate()}
                  </span>
                  <span className={`text-xs uppercase ${
                    isUpcoming(selectedEvent.event_date) ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {new Date(selectedEvent.event_date).toLocaleString('default', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <span className={`px-3 py-1 text-sm rounded-full ${getEventTypeColor(selectedEvent.type)}`}>
                  {selectedEvent.type}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Description</h3>
                <p className="text-gray-900">{selectedEvent.description}</p>
              </div>

              {selectedEvent.projects_involved && selectedEvent.projects_involved.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Related Projects</h3>
                  <div className="space-y-2">
                    {selectedEvent.projects_involved.map((projectId) => (
                      <div key={projectId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <FolderIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{getProjectName(projectId)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  );
}
