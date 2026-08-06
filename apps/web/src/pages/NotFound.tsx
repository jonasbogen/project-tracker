import { useNavigate } from 'react-router';
import Button from '@intility/bifrost-react/Button';
import Icon from '@intility/bifrost-react/Icon';
import Message from '@intility/bifrost-react/Message';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Message state="warning" header="Siden finnes ikke">
      <Button variant="flat" onClick={() => navigate('/')}>
        <Icon icon={faArrowLeft} marginRight />
        Tilbake til prosjekter
      </Button>
    </Message>
  );
}
