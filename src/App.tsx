/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './Dashboard';
import CitizenReport from './CitizenReport';
import DriverPortal from './DriverPortal';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/report" element={<CitizenReport />} />
      <Route path="/driver" element={<DriverPortal />} />
    </Routes>
  );
}

