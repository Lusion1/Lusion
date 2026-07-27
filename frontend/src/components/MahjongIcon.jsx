import React from 'react';

export default function MahjongIcon({ className = '', size = 24 }) {
    return (
        <span
            aria-hidden="true"
            className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
            style={{ width: size, height: size, fontSize: size }}
        >
            🀄
        </span>
    );
}
