import React, {useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ScrollView,Text,View} from 'react-native';
import ArenaSimulationScreen from '../screens/ArenaSimulationScreen';
import ScreenContainer from '../components/ScreenContainer';
import VideoPicker from '../components/immortal/VideoPicker';
import FormatPicker from '../components/immortal/FormatPicker';
import {ActionButton} from '../components/immortal/AttemptFormParts';
import {FALLBACK_FORMATS} from '../domain/formats';
import type {FormatKey} from '../domain/types';
import type {VideoCandidate} from '../domain/video';
import {COLORS} from '../theme';

const Stack=createNativeStackNavigator();
function Demo({navigation}:any){return <ArenaSimulationScreen exitLabel="Tester la caméra" onExit={()=>navigation.navigate('CameraLab')}/>;}
function CameraLab({navigation}:any){
 const [format,setFormat]=useState<FormatKey>('pullups_max');
 const [video,setVideo]=useState<VideoCandidate|null>(null);
 const selected=FALLBACK_FORMATS.find(f=>f.key===format)!;
 return <ScreenContainer><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:18,paddingBottom:40,width:'100%',maxWidth:720,alignSelf:'center'}}>
  <Text accessibilityRole="header" style={{color:COLORS.text,fontSize:27,fontWeight:'900'}}>Essaie le cadrage caméra</Text>
  <View style={{padding:14,borderRadius:14,borderWidth:1,borderColor:'#D4AF3750',backgroundColor:'#D4AF3710',gap:7}}>
   <Text style={{color:'#EDD284',fontWeight:'800'}}>Démo gratuite · aucune vidéo publiée</Text>
   <Text style={{color:COLORS.textMuted,fontSize:13,lineHeight:20}}>La capture reste dans ton navigateur. Aucun compte, stockage serveur ni validation de record dans cette démo. Les repères sont manuels, sans comptage IA.</Text>
  </View>
  <FormatPicker formats={FALLBACK_FORMATS} value={format} onChange={setFormat} disabled={!!video}/>
  <VideoPicker value={video} onChange={setVideo} formatKey={format} maxSeconds={selected.max_video_seconds}/>
  <ActionButton label="Retour à l’arène" variant="ghost" onPress={()=>navigation.navigate('Demo')}/>
 </ScrollView></ScreenContainer>;
}
export default function PreviewApp(){return <SafeAreaProvider><NavigationContainer linking={{prefixes:[],config:{screens:{Demo:'',CameraLab:'camera'}}}}><Stack.Navigator screenOptions={{headerShown:false}}><Stack.Screen name="Demo" component={Demo} options={{title:"IMMORTAL · Démo"}}/><Stack.Screen name="CameraLab" component={CameraLab} options={{title:"IMMORTAL · Caméra"}}/></Stack.Navigator></NavigationContainer></SafeAreaProvider>;}
