import React from 'react';
import { Button, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Outer = createNativeStackNavigator();
const Inner = createNativeStackNavigator();
const root = createNavigationContainerRef();
let cycles = 0;
let running = false;
let mode = 'pop';

function Home({ navigation }) {
  const start = (nextMode) => {
    mode = nextMode;
    cycles = 0;
    running = true;
    navigation.push('Nested');
  };
  React.useEffect(() => navigation.addListener('focus', () => {
    if (running && cycles < 100) {
      const timer = setTimeout(() => navigation.push('Nested'), 100);
      return () => clearTimeout(timer);
    }
    running = false;
  }), [navigation]);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text>Nested native-stack header teardown</Text>
    <Button title="Open nested stack" onPress={() => navigation.push('Nested')} />
    <Button title="Stress parent pop (100 cycles)" onPress={() => start('pop')} />
    <Button title="Stress parent reset (100 cycles)" onPress={() => start('reset')} />
    <Button title="Stop" onPress={() => { running = false; }} />
  </View>;
}
function Child({ navigation }) {
  const [tick, setTick] = React.useState(0);
  const [inject, setInject] = React.useState(false);
  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: inject ? "INJECT_PARENT_DETACH" : `Child ${tick}`,
      headerRight: () => tick % 2 ? <Text>Right</Text> : null,
    });
  }, [navigation, tick, inject]);
  React.useEffect(() => {
    const interval = setInterval(() => setTick(x => x + 1), 16);
    const timer = running ? setTimeout(() => {
      cycles += 1;
      console.log(`REPRO cycle=${cycles} mode=${mode}`);
      if (mode === 'reset') root.resetRoot({ index: 0, routes: [{ name: 'Home' }] });
      else navigation.getParent().goBack();
    }, 150) : null;
    return () => { clearInterval(interval); clearTimeout(timer); };
  }, [navigation]);
  return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
    <Text>Inner root: back state recurses to its parent screen.</Text>
    <Text>Completed cycles: {cycles}</Text>
    <Button title="Optional: inject parent detach (requires native variant)" onPress={() => setInject(true)} />
    <Button title="Pop parent" onPress={() => navigation.getParent().goBack()} />
    <Button title="Reset outer stack" onPress={() => root.resetRoot({ index: 0, routes: [{ name: 'Home' }] })} />
  </View>;
}
function Nested() {
  return <Inner.Navigator><Inner.Screen name="Child" component={Child} /></Inner.Navigator>;
}
export default function App() {
  return <NavigationContainer ref={root}><Outer.Navigator>
    <Outer.Screen name="Home" component={Home} />
    <Outer.Screen name="Nested" component={Nested} options={{ headerShown: false }} />
  </Outer.Navigator></NavigationContainer>;
}
