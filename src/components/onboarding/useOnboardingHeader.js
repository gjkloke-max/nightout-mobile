import { useLayoutEffect } from 'react'
import { HeaderBackButton } from '@react-navigation/elements'
import { authColors } from '../../theme/authTheme'

/**
 * Native stack back control (Settings-style arrow) with custom onPress; body titles stay on-screen.
 */
export function useOnboardingHeader(navigation, onBack) {
  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerBackTitleVisible: false,
      headerLeft: (props) => (
        <HeaderBackButton
          {...props}
          displayMode="minimal"
          tintColor={authColors.textPrimary}
          onPress={() => {
            const out = onBack()
            if (out != null && typeof out.then === 'function') void out
          }}
        />
      ),
    })
  }, [navigation, onBack])
}
