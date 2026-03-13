import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PlayerRegistration from '../screens/PlayerRegistration';
import TournamentRounds from '../screens/TournamentRounds';
import Results from '../screens/Results';

const Stack = createNativeStackNavigator();

export default function Index() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Registro" component={PlayerRegistration} />
      <Stack.Screen name="Rondas" component={TournamentRounds} />
      <Stack.Screen name="Resultados" component={Results} />
    </Stack.Navigator>
  );
}
