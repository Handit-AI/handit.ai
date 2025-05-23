/**
 * Devices Analytics Component
 * 
 * Displays device usage analytics in a card format, showing the distribution
 * of user sessions across different device types (desktop, mobile, tablet).
 * Includes a pie chart visualization and percentage breakdowns.
 */

'use client';

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Devices as DevicesIcon } from '@phosphor-icons/react/dist/ssr/Devices';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';

import { NoSsr } from '@/components/core/no-ssr';

/**
 * Devices Component
 * 
 * @param {Object} props - Component props
 * @param {Object} props.data - Analytics data for device distribution
 * @param {number} props.data.desktop - Number of desktop sessions
 * @param {number} props.data.mobile - Number of mobile sessions
 * @param {number} props.data.tablet - Number of tablet sessions
 * @returns {JSX.Element} The devices analytics component
 */
export function Devices({ data }) {
  const chartSize = 250;
  const chartTickness = 40;
  const total = data.reduce((acc, cur) => acc + cur.value, 0);
  const percentageData = data.map((entry) => ({ ...entry, value: entry.value / total * 100.0 }));
  return (
    <Card style={{
      height: '100%',
    }}>
      <CardHeader
        avatar={
          <Avatar>
            <DevicesIcon fontSize="var(--Icon-fontSize)" />
          </Avatar>
        }
        title="System Stability (30d)"
      />
      <CardContent>
        <Stack divider={<Divider />} spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <NoSsr fallback={<Box sx={{ height: `${chartSize}px`, width: `${chartSize}px` }} />}>
              <PieChart height={chartSize} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} width={chartSize}>
                <Pie
                  animationDuration={300}
                  cx={chartSize / 2}
                  cy={chartSize / 2}
                  data={percentageData}
                  dataKey="value"
                  innerRadius={chartSize / 2 - chartTickness}
                  nameKey="name"
                  outerRadius={chartSize / 2}
                  strokeWidth={0}
                >
                  {percentageData.map((entry) => (
                    <Cell fill={entry.color} key={entry.name} />
                  ))}
                </Pie>
                <Tooltip animationDuration={50} content={<TooltipContent />} />
              </PieChart>
            </NoSsr>
          </Box>
          <Legend payload={percentageData} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function Legend({ payload }) {
  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))' }}>
      {payload?.map((entry) => (
        <div key={entry.name}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box sx={{ bgcolor: entry.color, borderRadius: '2px', height: '4px', width: '16px' }} />
            <Typography variant="body2">{entry.name}</Typography>
          </Stack>
          <Typography variant="h5">
            {new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(entry.value / 100)}
          </Typography>
        </div>
      ))}
    </Box>
  );
}

function TooltipContent({ active, payload }) {
  if (!active) {
    return null;
  }

  return (
    <Paper sx={{ border: '1px solid var(--mui-palette-divider)', boxShadow: 'var(--mui-shadows-16)', p: 1 }}>
      <Stack spacing={2}>
        {payload?.map((entry) => (
          <Stack direction="row" key={entry.name} spacing={3} sx={{ alignItems: 'center' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flex: '1 1 auto' }}>
              <Box sx={{ bgcolor: entry.payload.fill, borderRadius: '2px', height: '8px', width: '8px' }} />
              <Typography sx={{ whiteSpace: 'nowrap' }}>{entry.name}</Typography>
            </Stack>
            <Typography color="text.secondary" variant="body2">
              {new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(entry.value / 100)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
