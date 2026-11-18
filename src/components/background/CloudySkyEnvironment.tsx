import React from 'react';

const CLOUDS = [
  { left: '-8%', top: '12%', width: '34%', delay: '-8s', layer: 'far' },
  { left: '24%', top: '27%', width: '28%', delay: '-34s', layer: 'mid' },
  { left: '68%', top: '17%', width: '38%', delay: '-21s', layer: 'far' },
  { left: '-4%', top: '56%', width: '42%', delay: '-42s', layer: 'near' },
  { left: '42%', top: '66%', width: '32%', delay: '-15s', layer: 'mid' },
  { left: '76%', top: '49%', width: '34%', delay: '-56s', layer: 'near' },
];

export const CloudySkyEnvironment: React.FC = () => (
  <div className="angel-cloudy-environment fixed inset-0 z-0" aria-hidden="true">
    <div className="angel-daylight-sun" />
    <div className="angel-daylight-wash" />
    <div className="angel-cloud-layer">
      {CLOUDS.map((cloud, index) => (
        <div
          key={index}
          className={`angel-cloud angel-cloud--${cloud.layer}`}
          style={{
            left: cloud.left,
            top: cloud.top,
            width: cloud.width,
            animationDelay: cloud.delay,
          }}
        />
      ))}
    </div>
  </div>
);
