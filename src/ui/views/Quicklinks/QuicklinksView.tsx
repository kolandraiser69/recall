import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Plus,
  Star,
  Search,
  RotateCcw,
  Pencil,
  Trash2,
  Globe,
  Bookmark,
} from 'lucide-react';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { SectionContainer } from '../../components/SectionContainer';
import { useToast } from '../../components/Toast';
import { quicklinkService } from '../../../services/quicklinkService';
import type { Quicklink } from '../../../core/models/quicklink';
import { QuicklinkModal } from './components/QuicklinkModal';

export const QuicklinksView: React.FC = () => {
  const toast = useToast();
  const [links, setLinks] = useState<Quicklink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuicklink, setSelectedQuicklink] = useState<Quicklink | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadLinks = async () => {
    const list = await quicklinkService.getQuicklinks();
    setLinks(list);
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await quicklinkService.toggleFavorite(id);
      await loadLinks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update favorite status.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await quicklinkService.deleteQuicklink(id);
      toast.success('Quicklink removed.');
      await loadLinks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to remove quicklink.');
    }
  };

  const handleRestoreDefaults = async () => {
    try {
      await quicklinkService.restoreDefaultQuicklinks();
      toast.success('Default university and AI quicklinks restored.');
      await loadLinks();
    } catch (err) {
      console.error(err);
      toast.error('Failed to restore defaults.');
    }
  };

  const filtered = links.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.title.toLowerCase().includes(q) ||
      l.domain.toLowerCase().includes(q) ||
      (l.category && l.category.toLowerCase().includes(q))
    );
  });

  const favorites = filtered.filter((l) => l.isFavorite);
  const standardLinks = filtered.filter((l) => !l.isFavorite);

  const renderQuicklinkCard = (item: Quicklink) => (
    <Card
      key={item.id}
      variant="standard"
      padding="md"
      className="group relative flex flex-col justify-between hover:border-[var(--accent)] transition-all duration-150"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--accent)]">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] truncate block transition-colors cursor-pointer"
                title={item.title}
              >
                {item.title}
              </a>
              <span className="text-[10px] font-mono text-[var(--text-tertiary)] truncate block">
                {item.domain}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => handleToggleFavorite(e, item.id)}
            className={`p-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
              item.isFavorite
                ? 'text-amber-500 fill-amber-500'
                : 'text-[var(--text-tertiary)] hover:text-amber-500'
            }`}
            title={item.isFavorite ? 'Remove from favorites' : 'Mark as favorite'}
          >
            <Star className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {item.category && (
          <div className="mt-2.5">
            <Badge variant="neutral" className="text-[10px]">
              {item.category}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 mt-3 border-t border-[var(--divider)]">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] hover:underline cursor-pointer"
        >
          <span>Open</span>
          <ExternalLink className="w-3 h-3" />
        </a>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => {
              setSelectedQuicklink(item);
              setIsModalOpen(true);
            }}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Edit"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDelete(e, item.id)}
            className="p-1 rounded-[var(--radius-sm)] hover:bg-red-500/10 text-[var(--text-tertiary)] hover:text-red-500 transition-colors cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--divider)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Quicklinks
            </h1>
            <Badge variant="neutral">University &amp; Tools</Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Frequently visited study portals, AI models, reference sheets, and web apps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleRestoreDefaults}
          >
            Reset Defaults
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              setSelectedQuicklink(null);
              setIsModalOpen(true);
            }}
          >
            Add Link
          </Button>
        </div>
      </div>

      {/* Search Filter Toolbar */}
      <div className="max-w-md">
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by name, domain, or category..."
          leftIcon={<Search className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />}
        />
      </div>

      {/* Pinned Favorites Section */}
      {favorites.length > 0 && (
        <SectionContainer
          title="Pinned Favorites"
          description="Quick access to primary university resources and tools"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {favorites.map(renderQuicklinkCard)}
          </div>
        </SectionContainer>
      )}

      {/* Standard Links Section */}
      <SectionContainer
        title={favorites.length > 0 ? 'All Quicklinks' : 'Web Resources'}
        description="Curated links for university courses, AI study assistants, and tooling"
      >
        {standardLinks.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {standardLinks.map(renderQuicklinkCard)}
          </div>
        ) : (
          favorites.length === 0 && (
            <Card variant="standard" padding="lg" className="text-center py-10">
              <div className="w-10 h-10 mx-auto mb-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-tertiary)]">
                <Bookmark className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">No quicklinks found</h3>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1 mb-4">
                {searchQuery ? 'Try a different search term.' : 'Get started by restoring standard links.'}
              </p>
              <Button variant="secondary" size="sm" onClick={handleRestoreDefaults}>
                Restore Default Quicklinks
              </Button>
            </Card>
          )
        )}
      </SectionContainer>

      {/* Modal */}
      <QuicklinkModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedQuicklink={selectedQuicklink}
        onSaved={loadLinks}
      />
    </div>
  );
};
