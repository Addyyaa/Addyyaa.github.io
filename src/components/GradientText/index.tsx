import React from 'react';
import styles from './styles.module.css';

interface GradientTextProps {
    children: React.ReactNode;
    variant?: 'rainbow' | 'ocean' | 'sunset' | 'forest' | 'neon';
    size?: 'small' | 'medium' | 'large';
    animated?: boolean;
    className?: string;
}

const GradientText: React.FC<GradientTextProps> = ({
    children,
    variant = 'rainbow',
    size = 'medium',
    animated = true,
    className = '',
}) => {
    const variantClass = styles[variant];
    const sizeClass = styles[size];
    const animationClass = animated ? styles.animated : '';

    return (
        <span
            className={`${styles.gradientText} ${variantClass} ${sizeClass} ${animationClass} ${className}`}
        >
            {children}
        </span>
    );
};

export default GradientText;
