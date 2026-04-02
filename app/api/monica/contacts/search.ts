// api/monica/contacts/search.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '../../../../utils/auth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    // Implement search contact logic here
    res.status(200).json({ message: 'Search contact endpoint' });
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default authenticate(handler);

