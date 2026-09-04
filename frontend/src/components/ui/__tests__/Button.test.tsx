import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Click me' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled while isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});
