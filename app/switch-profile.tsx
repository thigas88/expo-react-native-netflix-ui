import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Dimensions, TouchableOpacity, Image, View, Pressable } from 'react-native';
import { useEffect, useCallback, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ThemedText } from '@/components/ThemedText';
import { useRootScale } from '@/contexts/RootScaleContext';
import { useUser } from '@/contexts/UserContext';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    FadeIn,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const SCALE_FACTOR = 0.83;
const DRAG_THRESHOLD = Math.min(height * 0.20, 150);
const HORIZONTAL_DRAG_THRESHOLD = Math.min(width * 0.51, 80);
const DIRECTION_LOCK_ANGLE = 45;
const ENABLE_HORIZONTAL_DRAG_CLOSE = false;

export default function SwitchProfileScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { setScale } = useRootScale();
    const { profiles, selectProfile } = useUser();
    const translateY = useSharedValue(0);
    const isClosing = useRef(false);
    const statusBarStyle = useSharedValue<'light' | 'dark'>('light');
    const scrollOffset = useSharedValue(0);
    const isDragging = useSharedValue(false);
    const translateX = useSharedValue(0);
    const initialGestureX = useSharedValue(0);
    const initialGestureY = useSharedValue(0);
    const isHorizontalGesture = useSharedValue(false);
    const isScrolling = useSharedValue(false);
    const blurIntensity = useSharedValue(20);

    const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

    const handleHapticFeedback = useCallback(() => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
            console.log('Haptics not available:', error);
        }
    }, []);

    const goBack = useCallback(() => {
        if (!isClosing.current) {
            isClosing.current = true;
            handleHapticFeedback();
            requestAnimationFrame(() => {
                router.back();
            });
        }
    }, [router, handleHapticFeedback]);

    const handleScale = useCallback((newScale: number) => {
        try {
            setScale(newScale);
        } catch (error) {
            console.log('Scale error:', error);
        }
    }, [setScale]);

    const calculateGestureAngle = (x: number, y: number) => {
        'worklet';
        const angle = Math.abs(Math.atan2(y, x) * (180 / Math.PI));
        return angle;
    };

    const panGesture = Gesture.Pan()
        .onStart((event) => {
            'worklet';
            initialGestureX.value = event.x;
            initialGestureY.value = event.y;
            isHorizontalGesture.value = false;

            if (scrollOffset.value <= 0) {
                isDragging.value = true;
            }
        })
        .onUpdate((event) => {
            'worklet';
            const dx = event.translationX;
            const dy = event.translationY;
            const angle = calculateGestureAngle(dx, dy);

            if (ENABLE_HORIZONTAL_DRAG_CLOSE && !isHorizontalGesture.value && !isScrolling.value) {
                if (Math.abs(dx) > 10) {
                    if (angle < DIRECTION_LOCK_ANGLE) {
                        isHorizontalGesture.value = true;
                    }
                }
            }

            if (ENABLE_HORIZONTAL_DRAG_CLOSE && isHorizontalGesture.value) {
                translateX.value = dx;
                translateY.value = dy;
                blurIntensity.value = Math.max(0, 20 - (Math.abs(dx) / 10));

                if (Math.abs(dx) / 300 > 0.2) {
                    statusBarStyle.value = 'dark';
                } else {
                    statusBarStyle.value = 'light';
                }
            }
            else if (scrollOffset.value <= 0 && isDragging.value) {
                translateY.value = Math.max(0, dy);
                blurIntensity.value = Math.max(0, 20 - (dy / 20));

                if (dy / 600 > 0.5) {
                    statusBarStyle.value = 'dark';
                } else {
                    statusBarStyle.value = 'light';
                }
            }
        })
        .onEnd((event) => {
            'worklet';
            isDragging.value = false;

            if (ENABLE_HORIZONTAL_DRAG_CLOSE && isHorizontalGesture.value) {
                const dx = event.translationX;
                const dy = event.translationY;
                const totalDistance = Math.sqrt(dx * dx + dy * dy);
                const shouldClose = totalDistance > HORIZONTAL_DRAG_THRESHOLD;

                if (shouldClose) {
                    const exitX = dx * 2;
                    const exitY = dy * 2;

                    translateX.value = withTiming(exitX, { duration: 300 });
                    translateY.value = withTiming(exitY, { duration: 300 });

                    runOnJS(handleScale)(1);
                    runOnJS(handleHapticFeedback)();
                    runOnJS(goBack)();
                } else {
                    translateX.value = withSpring(0, {
                        damping: 15,
                        stiffness: 150,
                    });
                    translateY.value = withSpring(0, {
                        damping: 15,
                        stiffness: 150,
                    });
                    runOnJS(handleScale)(SCALE_FACTOR);
                }
            }
            else if (scrollOffset.value <= 0) {
                const shouldClose = event.translationY > DRAG_THRESHOLD;

                if (shouldClose) {
                    translateY.value = withTiming(event.translationY + 100, {
                        duration: 300,
                    });
                    runOnJS(handleScale)(1);
                    runOnJS(handleHapticFeedback)();
                    runOnJS(goBack)();
                } else {
                    translateY.value = withSpring(0, {
                        damping: 15,
                        stiffness: 150,
                    });
                    runOnJS(handleScale)(SCALE_FACTOR);
                }
            }
        })
        .onFinalize(() => {
            'worklet';
            isDragging.value = false;
            isHorizontalGesture.value = false;
        });

    const scrollGesture = Gesture.Native()
        .onBegin(() => {
            'worklet';
            isScrolling.value = true;
            if (!isDragging.value) {
                translateY.value = 0;
            }
        })
        .onEnd(() => {
            'worklet';
            isScrolling.value = false;
        });

    const composedGestures = Gesture.Simultaneous(panGesture, scrollGesture);

    const ScrollComponent = useCallback((props: any) => {
        return (
            <GestureDetector gesture={composedGestures}>
                <Animated.ScrollView
                    {...props}
                    onScroll={(event) => {
                        'worklet';
                        scrollOffset.value = event.nativeEvent.contentOffset.y;
                        if (!isDragging.value && translateY.value !== 0) {
                            translateY.value = 0;
                        }
                        props.onScroll?.(event);
                    }}
                    scrollEventThrottle={16}
                    // bounces={scrollOffset.value >= 0 && !isDragging.value}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={false}


                />
            </GestureDetector>
        );
    }, [composedGestures]);

    const handleProfileSelect = async (profileId: string) => {
        selectProfile(profileId);
        goBack();
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value }
        ],
        opacity: withSpring(1),
    }));

    useEffect(() => {
        const timeout = setTimeout(() => {
            try {
                setScale(SCALE_FACTOR);
            } catch (error) {
                console.log('Initial scale error:', error);
            }
        }, 0);

        return () => {
            clearTimeout(timeout);
            try {
                setScale(1);
            } catch (error) {
                console.log('Cleanup scale error:', error);
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            <Pressable onPress={() => router.back()} style={styles.clickableContainer}>
                <StatusBar animated={true} style={statusBarStyle.value} />
                <Animated.View style={[styles.modalContent, animatedStyle]}>
                    <ScrollComponent>
                        <View style={styles.switchProfileContainer}>
                            <View style={styles.header}>
                                <View style={styles.headerTitle}>
                                    <ThemedText style={styles.title}>Switch Profiles</ThemedText>
                                </View>
                                <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                                    <Ionicons name="close-outline" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.gridContainer}>
                                {profiles.map((profile, index) => (
                                    <Animated.View
                                        key={profile.id}
                                        entering={FadeIn.delay(index * 100 + 250)}
                                    >
                                        <TouchableOpacity
                                            onPress={() => handleProfileSelect(profile.id)}
                                            style={styles.profileButton}
                                        >
                                            <View style={styles.profileContainer}>
                                                <Image
                                                    source={{ uri: profile.avatar }}
                                                    style={styles.avatar}
                                                />
                                                <ThemedText style={styles.profileName}>{profile.name}</ThemedText>
                                            </View>
                                        </TouchableOpacity>
                                    </Animated.View>
                                ))}

                                <TouchableOpacity style={styles.profileButton}>
                                    <View style={styles.addProfileContainer}>
                                        <Ionicons name="add" size={44} color="#fff" />
                                    </View>
                                    <ThemedText style={styles.addProfileText}>Add Profile</ThemedText>
                                </TouchableOpacity>

                            </View>

                            <TouchableOpacity style={styles.doneButton}>
                                <Ionicons name="pencil" size={24} color="#ffffffba" />
                                <ThemedText style={styles.doneButtonText}>Manage Profiles</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </ScrollComponent>
                </Animated.View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    doneButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 20,
        marginBottom: 20,
        justifyContent: 'center',
        marginTop: 12,
    },
    doneButtonText: {
        fontSize: 16,
        color: '#ffffffba',
        fontWeight: '700',
    },
    container: {
        flex: 1,
        backgroundColor: '#0000008a',
    },
    clickableContainer: {
        flex: 1
    },
    modalContent: {
        flex: 1,
        backgroundColor: '#2d2d2d',
        marginTop: height * 0.7, // This pushes the content down
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
    },
    switchProfileContainer: {
        flex: 1,
        paddingTop: 20,
        minHeight: height * 0.7, // Ensures the container takes up at least 70% of screen height
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    headerTitle: {
        flex: 1,
        // alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '600',
        color: '#fff',
    },
    editButton: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        // alignItems: 'center',
    },
    profileButton: {
        width: width * 0.20,
        aspectRatio: 1,
        marginBottom: 24,
        alignItems: 'center',
    },
    profileContainer: {
        alignItems: 'center',
        // gap: 2,
    },
    avatar: {
        width: '80%',
        height: undefined,
        aspectRatio: 1,
        borderRadius: 6,
    },
    profileName: {
        fontSize: 12,
        fontWeight: '500',
        color: '#e5e5e5',
    },
    addProfileContainer: {
        width: width * 0.15,
        aspectRatio: 1,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#424242',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    addProfileText: {
        fontSize: 12,
        color: '#ffffff',
        // marginTop: 8,
        fontWeight: '400',
    },
    closeButton: {
        padding: 2,
        backgroundColor: '#0000005c',
        borderRadius: 100,
    },
});
