import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../src/ui/components/Button';
import { SegmentedControl } from '../../src/ui/components/SegmentedControl';
import { Toggle } from '../../src/ui/components/Toggle';
import { Modal } from '../../src/ui/components/Modal';
import { Checkbox } from '../../src/ui/components/Checkbox';
import { Badge } from '../../src/ui/components/Badge';

describe('Reusable UI Components', () => {
  describe('Button', () => {
    it('should render children and handle click', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);

      const btn = screen.getByRole('button', { name: /click me/i });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled or isLoading is true', () => {
      const handleClick = vi.fn();
      render(
        <Button isLoading onClick={handleClick}>
          Submitting
        </Button>
      );

      const btn = screen.getByRole('button');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('SegmentedControl', () => {
    it('should select active item and invoke onChange', () => {
      const handleSelect = vi.fn();
      const options = [
        { value: 'opt1', label: 'Option 1' },
        { value: 'opt2', label: 'Option 2' },
      ];

      render(
        <SegmentedControl options={options} value="opt1" onChange={handleSelect} />
      );

      const opt2 = screen.getByRole('radio', { name: /option 2/i });
      fireEvent.click(opt2);
      expect(handleSelect).toHaveBeenCalledWith('opt2');
    });
  });

  describe('Toggle', () => {
    it('should render checked state and trigger onChange', () => {
      const handleChange = vi.fn();
      render(
        <Toggle checked={false} onChange={handleChange} label="Enable Reminders" />
      );

      const toggle = screen.getByRole('switch');
      expect(toggle.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(toggle);
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('Modal', () => {
    it('should render content when open and close on Escape key', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={false} onClose={handleClose} title="Test Modal">
          <p>Modal Body</p>
        </Modal>
      );

      expect(screen.queryByText('Modal Body')).toBeNull();

      rerender(
        <Modal isOpen={true} onClose={handleClose} title="Test Modal">
          <p>Modal Body</p>
        </Modal>
      );

      expect(screen.getByText('Modal Body')).toBeDefined();

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Checkbox', () => {
    it('should toggle and trigger change event', () => {
      const handleChange = vi.fn();
      render(<Checkbox label="Agree to terms" onChange={handleChange} />);

      const checkbox = screen.getByLabelText(/agree to terms/i);
      fireEvent.click(checkbox);
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Badge', () => {
    it('should render badge with variant styling', () => {
      render(<Badge variant="success">Completed</Badge>);
      expect(screen.getByText('Completed')).toBeDefined();
    });
  });
});
