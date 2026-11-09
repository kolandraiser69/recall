import React, { useState, useEffect } from 'react';
import { Globe, Bookmark } from 'lucide-react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { useToast } from '../../../components/Toast';
import { quicklinkService } from '../../../../services/quicklinkService';
import type { Quicklink } from '../../../../core/models/quicklink';

export interface QuicklinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedQuicklink?: Quicklink | null;
  onSaved: () => void;
}

export const QuicklinkModal: React.FC<QuicklinkModalProps> = ({
  isOpen,
  onClose,
  selectedQuicklink,
  onSaved,
}) => {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedQuicklink) {
      setTitle(selectedQuicklink.title);
      setUrl(selectedQuicklink.url);
      setCategory(selectedQuicklink.category || '');
      setIsFavorite(selectedQuicklink.isFavorite);
    } else {
      setTitle('');
      setUrl('');
      setCategory('');
      setIsFavorite(false);
    }
  }, [isOpen, selectedQuicklink]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) {
      toast.error('Title and URL are required.');
      return;
    }

    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    setIsSubmitting(true);
    try {
      if (selectedQuicklink) {
        await quicklinkService.updateQuicklink(selectedQuicklink.id, {
          title: title.trim(),
          url: normalizedUrl,
          category: category.trim() || undefined,
          isFavorite,
        });
        toast.success('Quicklink updated.');
      } else {
        await quicklinkService.addQuicklink({
          title: title.trim(),
          url: normalizedUrl,
          category: category.trim() || undefined,
          isFavorite,
        });
        toast.success('Quicklink added.');
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Failed to save quicklink:', err);
      toast.error('Failed to save quicklink.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedQuicklink ? 'Edit Quicklink' : 'Add Quicklink'}
      description="Save university portals, research tools, or reference sites"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-primary)]">Title *</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. THI Moodle / Lernportal"
            autoFocus
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Web Address (URL) *</span>
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://thi.de"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1">
            <Bookmark className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
            <span>Category (Optional)</span>
          </label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. University, AI Assistant, Tools"
          />
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="rounded border-[var(--border-subtle)] text-[var(--accent)]"
            />
            <span className="text-xs font-medium text-[var(--text-primary)]">
              Mark as Favorite (Pins to top)
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--divider)]">
          <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
            {selectedQuicklink ? 'Save Changes' : 'Add Link'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
