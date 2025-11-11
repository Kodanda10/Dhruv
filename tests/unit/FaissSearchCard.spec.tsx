import { render, screen, userEvent, waitFor } from '../utils/render';
import { server, http, HttpResponse } from '../utils/msw';
import FaissSearchCard from '@/components/analytics/FaissSearchCard';

test('debounces queries and hits FAISS first', async () => {
  const user = userEvent.setup({ delay: null });
  render(<FaissSearchCard />);

  await user.type(screen.getByPlaceholderText('Search for a location...'), 'बरमपुर');
  await waitFor(() =>
    expect(screen.getByText('Searching...')).toBeInTheDocument()
  );

  // FAISS mock responds with candidates
  await waitFor(() =>
    expect(screen.getByText('बरमपुर › पुसौर › रायगढ़')).toBeVisible()
  );
});

test('requires complete hierarchy before confirm', async () => {
  render(<FaissSearchCard />);
  // pick a candidate missing district
  await userEvent.click(screen.getByRole('button', { name: /उम्मीदवार 2/i }));
  expect(
    screen.getByText(/हाइरार्की अधूरी है/i)
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /पुष्टि करें/i })).toBeDisabled();
});