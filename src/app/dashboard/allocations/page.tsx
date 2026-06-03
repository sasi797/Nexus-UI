'use client';

import { motion } from 'framer-motion';
import { pageTransition } from '@/lib/animations';

export default function AllocationsPage() {
  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-3 max-w-4xl">
      {/* Allocation content coming soon */}
    </motion.div>
  );
}
