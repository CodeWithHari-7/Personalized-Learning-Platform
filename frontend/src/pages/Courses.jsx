import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Star, Clock, Award, ChevronLeft, ChevronRight, BookOpen, AlertCircle, Loader2, DollarSign, Layers, Building2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { coursesAPI, progressAPI } from '../services/api';

const COURSES_PER_PAGE = 12;

const StarRating = ({ rating }) => {
  const stars = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={13}
          className={s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-white/20 fill-white/10'}
        />
      ))}
      <span className="text-xs text-white/50 ml-1">{rating ? rating.toFixed(1) : 'N/A'}</span>
    </div>
  );
};

const SkeletonCard = () => (
  <div className="glass-card rounded-2xl p-5 animate-pulse">
    <div className="h-4 bg-white/10 rounded w-3/4 mb-3" />
    <div className="h-3 bg-white/10 rounded w-1/2 mb-4" />
    <div className="flex gap-2 mb-4">
      <div className="h-5 bg-white/10 rounded-full w-20" />
      <div className="h-5 bg-white/10 rounded-full w-16" />
    </div>
    <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
    <div className="h-3 bg-white/10 rounded w-1/2 mb-6" />
    <div className="h-9 bg-white/10 rounded-xl w-full" />
  </div>
);

const EmptyState = ({ query }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-24 gap-4">
    <div className="p-5 rounded-full bg-white/5 border border-white/10">
      <BookOpen size={40} className="text-white/30" />
    </div>
    <p className="text-white/60 text-lg font-medium">No courses found</p>
    <p className="text-white/35 text-sm">
      {query ? `Try a different search term or clear the filters.` : 'Adjust your filters to explore courses.'}
    </p>
  </div>
);

const levelColors = {
  Beginner: 'badge-green',
  Intermediate: 'badge-blue',
  Advanced: 'badge-purple',
};

const CourseCard = ({ course, onEnroll, enrollingId }) => {
  const isEnrolling = enrollingId === course.id;
  const levelBadge = levelColors[course.level] ?? 'badge';

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3 hover:border-white/25 transition-all duration-300 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors">
          {course.course_name}
        </h3>
        {course.certificate && (
          <span title="Certificate available" className="shrink-0">
            <Award size={16} className="text-yellow-400" />
          </span>
        )}
      </div>

      {/* Provider */}
      <div className="flex items-center gap-1.5 text-white/50 text-xs">
        <Building2 size={12} />
        <span className="truncate">{course.provider}</span>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="badge badge-purple text-xs px-2 py-0.5 rounded-full">
          {course.category}
        </span>
        <span className={`badge ${levelBadge} text-xs px-2 py-0.5 rounded-full`}>
          {course.level}
        </span>
      </div>

      {/* Rating */}
      <StarRating rating={course.rating} />

      {/* Meta */}
      <div className="flex items-center gap-3 text-white/45 text-xs">
        {course.duration && (
          <span className="flex items-center gap-1">
            <Clock size={12} /> {course.duration}
          </span>
        )}
        <span className="flex items-center gap-1 font-semibold text-emerald-400">
          <DollarSign size={12} />
          {course.price === 0 ? 'Free' : `$${course.price}`}
        </span>
      </div>

      {/* Enroll Button */}
      <button
        onClick={() => onEnroll(course)}
        disabled={isEnrolling}
        className="btn-primary mt-auto rounded-xl py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isEnrolling ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Enrolling…
          </>
        ) : (
          'Enroll Now'
        )}
      </button>
    </div>
  );
};

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [provider, setProvider] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  // Derived option lists
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  const [providers, setProviders] = useState([]);

  // Pagination
  const [page, setPage] = useState(1);

  // Enroll state
  const [enrollingId, setEnrollingId] = useState(null);

  // Fetch courses
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (category) params.category = category;
      if (level) params.level = level;
      if (provider) params.provider = provider;
      if (maxPrice !== '') params.max_price = maxPrice;

      const data = await coursesAPI.getAll(params);
      const list = Array.isArray(data) ? data : data.results ?? data.courses ?? [];
      setCourses(list);

      // Populate filter options from full result set
      setCategories([...new Set(list.map((c) => c.category).filter(Boolean))].sort());
      setLevels([...new Set(list.map((c) => c.level).filter(Boolean))].sort());
      setProviders([...new Set(list.map((c) => c.provider).filter(Boolean))].sort());
    } catch (err) {
      console.error(err);
      setError('Failed to load courses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, category, level, provider, maxPrice]);

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(fetchCourses, 350);
    return () => clearTimeout(timer);
  }, [fetchCourses]);

  const handleEnroll = async (course) => {
    // Backend requires the string 'course_id', UI might use primary key 'id' for loading state
    const apiCourseId = course.course_id; 
    const uiCourseId = course.id ?? course.course_id;
    
    setEnrollingId(uiCourseId);
    try {
      await progressAPI.enroll({ course_id: apiCourseId });
      toast.success('Successfully enrolled! Opening course resource...');
      fetchCourses(); // Immediately remove/hide from available courses list
      
      let baseUrl = '';
      const cat = (course.category || '').toLowerCase();
      const courseName = encodeURIComponent(course.course_name || '');
      
      if (course.url) {
        window.open(course.url, '_blank', 'noopener,noreferrer');
        return;
      }
      
      if (cat.includes('machine learning') || cat.includes('data science') || cat.includes('statistics')) {
        baseUrl = 'https://www.coursera.org/search?query=';
      } else if (cat.includes('programming') || cat.includes('development') || cat.includes('python')) {
        baseUrl = 'https://www.udemy.com/courses/search/?q=';
      } else if (cat.includes('cloud') || cat.includes('ai') || cat.includes('artificial intelligence') || cat.includes('nlp')) {
        baseUrl = 'https://www.youtube.com/results?search_query=';
      } else {
        baseUrl = 'https://www.google.com/search?q=course+';
      }
      
      window.open(`${baseUrl}${courseName}`, '_blank', 'noopener,noreferrer');
      
    } catch (err) {
      let detail = err?.response?.data?.detail;
      let msg = Array.isArray(detail) ? detail[0].msg : (detail ?? err?.message ?? 'Enrollment failed.');
      if (typeof msg !== 'string') msg = JSON.stringify(msg);
      toast.error(msg);
    } finally {
      setEnrollingId(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setLevel('');
    setProvider('');
    setMaxPrice('');
    setPage(1);
  };

  const hasFilters = search || category || level || provider || maxPrice !== '';

  // Pagination
  const totalPages = Math.ceil(courses.length / COURSES_PER_PAGE);
  const paginated = courses.slice((page - 1) * COURSES_PER_PAGE, page * COURSES_PER_PAGE);

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Course Catalog</h1>
        <p className="text-white/50 mt-1 text-sm">Discover and enroll in world-class learning experiences</p>
      </div>

      {/* Search & Filters */}
      <div className="glass-card rounded-2xl p-5 mb-8 flex flex-col gap-4">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter size={15} className="text-white/40 shrink-0" />

          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="input-field rounded-xl py-2 px-3 text-sm flex-1 min-w-[130px]"
          >
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={level}
            onChange={(e) => { setLevel(e.target.value); setPage(1); }}
            className="input-field rounded-xl py-2 px-3 text-sm flex-1 min-w-[120px]"
          >
            <option value="">All Levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value); setPage(1); }}
            className="input-field rounded-xl py-2 px-3 text-sm flex-1 min-w-[140px]"
          >
            <option value="">All Providers</option>
            {providers.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>

          <div className="relative flex-1 min-w-[120px]">
            <DollarSign size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <input
              type="number"
              placeholder="Max Price"
              value={maxPrice}
              min={0}
              onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
              className="input-field w-full pl-8 pr-3 py-2 rounded-xl text-sm"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary rounded-xl py-2 px-4 text-sm shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      {!loading && !error && (
        <div className="flex items-center justify-between mb-5">
          <p className="text-white/45 text-sm">
            <span className="text-white font-semibold">{courses.length}</span> course{courses.length !== 1 ? 's' : ''} found
          </p>
          {totalPages > 1 && (
            <p className="text-white/45 text-sm">
              Page <span className="text-white font-semibold">{page}</span> of {totalPages}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-6 flex items-center gap-3 text-red-400 mb-6">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
          <button onClick={fetchCourses} className="ml-auto btn-secondary rounded-xl text-sm py-1.5 px-3">Retry</button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : paginated.length === 0
          ? <EmptyState query={search} />
          : paginated.map((course) => (
              <CourseCard
                key={course.id ?? course.course_id}
                course={course}
                onEnroll={handleEnroll}
                enrollingId={enrollingId}
              />
            ))
        }
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary rounded-xl p-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === '…' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1 text-white/30 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                      p === page
                        ? 'btn-primary'
                        : 'btn-secondary'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary rounded-xl p-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
