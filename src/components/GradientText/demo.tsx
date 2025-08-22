import React from 'react';
import GradientText from './index';
import styles from './demo.module.css';

const GradientTextDemo: React.FC = () => {
    return (
        <div className={styles.demoContainer}>
            <h2 className={styles.demoTitle}>渐变文字效果演示</h2>

            <div className={styles.demoSection}>
                <h3>彩虹渐变</h3>
                <GradientText variant="rainbow" size="large" animated={true}>
                    Addyya 的笔记 ⏱️
                </GradientText>
            </div>

            <div className={styles.demoSection}>
                <h3>海洋渐变</h3>
                <GradientText variant="ocean" size="large" animated={true}>
                    Addyya 的笔记 ⏱️
                </GradientText>
            </div>

            <div className={styles.demoSection}>
                <h3>日落渐变</h3>
                <GradientText variant="sunset" size="large" animated={true}>
                    Addyya 的笔记 ⏱️
                </GradientText>
            </div>

            <div className={styles.demoSection}>
                <h3>森林渐变</h3>
                <GradientText variant="forest" size="large" animated={true}>
                    Addyya 的笔记 ⏱️
                </GradientText>
            </div>

            <div className={styles.demoSection}>
                <h3>霓虹渐变</h3>
                <GradientText variant="neon" size="large" animated={true}>
                    Addyya 的笔记 ⏱️
                </GradientText>
            </div>

            <div className={styles.demoSection}>
                <h3>不同尺寸</h3>
                <div className={styles.sizeDemo}>
                    <GradientText variant="rainbow" size="small" animated={true}>
                        小号文字
                    </GradientText>
                    <GradientText variant="rainbow" size="medium" animated={true}>
                        中号文字
                    </GradientText>
                    <GradientText variant="rainbow" size="large" animated={true}>
                        大号文字
                    </GradientText>
                </div>
            </div>

            <div className={styles.demoSection}>
                <h3>静态效果（无动画）</h3>
                <GradientText variant="ocean" size="large" animated={false}>
                    Addyya 的笔记 ⏱️
                </GradientText>
            </div>
        </div>
    );
};

export default GradientTextDemo;
