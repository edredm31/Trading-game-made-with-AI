import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function CreateCompanyModal({ onClose }: Props) {
  const createCompany = useGameStore(state => state.createCompany);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Tech');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('10');
  const [shares, setShares] = useState('1000000');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createCompany({
      name,
      category,
      description,
      price: parseFloat(price),
      totalShares: parseInt(shares),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950">
          <h2 className="text-xl font-bold text-white">List New Company</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Company Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              placeholder="e.g. Acme Corp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option>Tech</option>
              <option>Food</option>
              <option>Gaming</option>
              <option>Finance</option>
              <option>Energy</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
            <textarea
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
              placeholder="What does your company do?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Initial Price ($)</label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Total Shares</label>
              <input
                required
                type="number"
                min="1000"
                step="1000"
                value={shares}
                onChange={e => setShares(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.3)]"
            >
              IPO Company
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
