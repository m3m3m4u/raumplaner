import SimpleRoomDetailPage from '../../../components/SimpleRoomDetailPage';

export default async function RoomPage({ params }) {
  const { id } = await params;
  return <SimpleRoomDetailPage roomId={id} />;
}
